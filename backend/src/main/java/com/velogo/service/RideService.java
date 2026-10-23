package com.velogo.service;

import com.velogo.domain.*;
import com.velogo.domain.enums.NotificationType;
import com.velogo.domain.enums.PaymentMethod;
import com.velogo.domain.enums.PaymentStatus;
import com.velogo.domain.enums.RideStatus;
import com.velogo.domain.enums.VehicleCategory;
import com.velogo.domain.enums.VerificationStatus;
import com.velogo.dto.RideDtos;
import com.velogo.exception.BadRequestException;
import com.velogo.exception.ForbiddenException;
import com.velogo.exception.ResourceNotFoundException;
import com.velogo.repository.*;
import com.velogo.websocket.RideEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class RideService {

    private final RideRepository rideRepository;
    private final RideStatusHistoryRepository historyRepository;
    private final CaptainProfileRepository captainRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final FareConfigurationRepository fareConfigRepository;
    private final PaymentRepository paymentRepository;
    private final RoutingService routingService;
    private final FareCalculationService fareCalculationService;
    private final MatchingService matchingService;
    private final NotificationService notificationService;
    private final RideEventPublisher eventPublisher;

    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional(readOnly = true)
    public RideDtos.FareEstimateResponse estimateFares(RideDtos.FareEstimateRequest req) {
        RoutingService.RouteInfo route = routingService.getRoute(
                req.pickupLat(), req.pickupLng(),
                req.destLat(), req.destLng()
        );

        List<RideDtos.CategoryEstimateDto> estimates = new ArrayList<>();

        for (VehicleCategory cat : VehicleCategory.values()) {
            FareCalculationService.FareBreakdown breakdown = fareCalculationService.calculateFare(
                    cat, route.distanceKm(), route.durationMinutes(), req.couponCode()
            );

            // Check if there are available captains in area
            List<MatchingService.CandidateCaptain> nearby = matchingService.findNearbyCaptains(cat, req.pickupLat(), req.pickupLng());
            boolean available = !nearby.isEmpty();

            String etaText = available ? (int) Math.max(2, Math.round(nearby.get(0).distanceKm() * 3)) + " mins away" : "3-5 mins away";
            String catName = switch (cat) {
                case BIKE -> "VeloGo Bike";
                case AUTO -> "VeloGo Auto";
                case CAB -> "VeloGo Prime Cab";
            };

            estimates.add(new RideDtos.CategoryEstimateDto(
                    cat,
                    catName,
                    etaText,
                    route.distanceKm(),
                    route.durationMinutes(),
                    breakdown.baseFare(),
                    breakdown.distanceCharge(),
                    breakdown.timeCharge(),
                    breakdown.bookingFee(),
                    breakdown.taxAmount(),
                    breakdown.discountAmount(),
                    breakdown.totalFare(),
                    true
            ));
        }

        RideDtos.CouponAppliedDto couponApplied = null;
        if (req.couponCode() != null && !req.couponCode().isBlank()) {
            couponApplied = fareCalculationService.validateCoupon(req.couponCode(), estimates.get(0).totalFare());
        }

        return new RideDtos.FareEstimateResponse(route.distanceKm(), route.durationMinutes(), estimates, couponApplied, route.geometry());
    }

    @Transactional
    public RideDtos.RideDto bookRide(User customer, RideDtos.BookRideRequest req) {
        // Prevent multiple concurrent active rides
        List<Ride> activeRides = rideRepository.findActiveRidesForCustomer(customer.getId());
        if (!activeRides.isEmpty()) {
            throw new BadRequestException("You already have an active ride in progress. Ride ID: " + activeRides.get(0).getId());
        }

        RoutingService.RouteInfo route = routingService.getRoute(
                req.pickupLat(), req.pickupLng(),
                req.destLat(), req.destLng()
        );

        FareCalculationService.FareBreakdown fare = fareCalculationService.calculateFare(
                req.vehicleCategory(), route.distanceKm(), route.durationMinutes(), req.couponCode()
        );

        String otp = String.format("%04d", secureRandom.nextInt(10000));

        Ride ride = Ride.builder()
                .id(UUID.randomUUID().toString())
                .customer(customer)
                .vehicleCategory(req.vehicleCategory())
                .status(RideStatus.SEARCHING)
                .pickupAddress(req.pickupAddress())
                .pickupLatitude(req.pickupLat())
                .pickupLongitude(req.pickupLng())
                .destAddress(req.destAddress())
                .destLatitude(req.destLat())
                .destLongitude(req.destLng())
                .distanceKm(route.distanceKm())
                .durationMinutes(route.durationMinutes())
                .estimatedFare(fare.totalFare())
                .finalFare(fare.totalFare())
                .discountAmount(fare.discountAmount())
                .taxAmount(fare.taxAmount())
                .couponCode(fare.couponCode())
                .otpCode(otp)
                .build();

        Ride savedRide = rideRepository.save(ride);

        // Record history
        recordStatusHistory(savedRide, null, RideStatus.SEARCHING, "Customer requested ride and searching for nearby captains");

        // Create initial pending payment record
        Payment payment = Payment.builder()
                .id(UUID.randomUUID().toString())
                .ride(savedRide)
                .customer(customer)
                .amount(fare.totalFare())
                .currency("INR")
                .method(req.paymentMethod())
                .status(PaymentStatus.PENDING)
                .idempotencyKey("idem-" + savedRide.getId())
                .build();
        paymentRepository.save(payment);

        // Notify customer
        notificationService.sendNotification(
                customer.getId(),
                "Searching for Captain",
                "Looking for the nearest " + req.vehicleCategory() + " captain for your trip.",
                NotificationType.RIDE_UPDATE
        );

        // Dispatch to candidate captains
        List<MatchingService.CandidateCaptain> nearbyCaptains = matchingService.findNearbyCaptains(
                req.vehicleCategory(), req.pickupLat(), req.pickupLng()
        );

        if (!nearbyCaptains.isEmpty()) {
            for (MatchingService.CandidateCaptain candidate : nearbyCaptains) {
                matchingService.dispatchRideToCaptain(savedRide, candidate.captain());
            }
        }

        return toRideDto(savedRide);
    }

    @Transactional
    public synchronized RideDtos.RideDto captainAcceptRide(String captainUserId, String rideId) {
        CaptainProfile captain = captainRepository.findByUserId(captainUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Captain profile not found for user: " + captainUserId));

        if (captain.getVerificationStatus() != VerificationStatus.APPROVED) {
            throw new BadRequestException("Captain account is not approved yet.");
        }

        if (!captain.isOnline() || !captain.isAvailable()) {
            throw new BadRequestException("You are currently offline or already assigned to a ride.");
        }

        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found with id: " + rideId));

        if (ride.getStatus() != RideStatus.SEARCHING && ride.getStatus() != RideStatus.REQUESTED) {
            throw new BadRequestException("This ride has already been accepted or is no longer available.");
        }

        // Assign captain and transition to ACCEPTED
        ride.setCaptain(captain);
        ride.setStatus(RideStatus.ACCEPTED);
        ride.setAcceptedAt(LocalDateTime.now());
        Ride updatedRide = rideRepository.save(ride);

        // Lock captain availability
        captain.setAvailable(false);
        captainRepository.save(captain);

        recordStatusHistory(updatedRide, RideStatus.SEARCHING, RideStatus.ACCEPTED,
                "Accepted by Captain " + captain.getUser().getFullName());

        // Notify customer
        notificationService.sendNotification(
                ride.getCustomer().getId(),
                "Captain Assigned!",
                captain.getUser().getFullName() + " has accepted your ride and is heading your way.",
                NotificationType.RIDE_UPDATE
        );

        // Publish live update to customer
        RideDtos.RideDto dto = toRideDto(updatedRide);
        eventPublisher.publishRideUpdate(rideId, dto);

        return dto;
    }

    @Transactional
    public RideDtos.RideDto captainArriveAtPickup(String captainUserId, String rideId) {
        Ride ride = getRideAndVerifyCaptain(captainUserId, rideId);

        if (ride.getStatus() != RideStatus.ACCEPTED && ride.getStatus() != RideStatus.ARRIVING) {
            throw new BadRequestException("Cannot mark arrival for ride in status: " + ride.getStatus());
        }

        ride.setStatus(RideStatus.ARRIVED);
        Ride updated = rideRepository.save(ride);

        recordStatusHistory(updated, ride.getStatus(), RideStatus.ARRIVED, "Captain arrived at pickup location");

        notificationService.sendNotification(
                ride.getCustomer().getId(),
                "Captain Arrived!",
                "Your captain has arrived at the pickup location. Share OTP " + ride.getOtpCode() + " to start the trip.",
                NotificationType.RIDE_UPDATE
        );

        RideDtos.RideDto dto = toRideDto(updated);
        eventPublisher.publishRideUpdate(rideId, dto);
        return dto;
    }

    @Transactional
    public RideDtos.RideDto captainStartTrip(String captainUserId, String rideId, String otpCode) {
        Ride ride = getRideAndVerifyCaptain(captainUserId, rideId);

        if (ride.getStatus() != RideStatus.ARRIVED && ride.getStatus() != RideStatus.ACCEPTED) {
            throw new BadRequestException("Trip can only be started once captain has arrived or accepted.");
        }

        if (otpCode == null || !otpCode.trim().equals(ride.getOtpCode())) {
            throw new BadRequestException("Invalid OTP code. Please enter the 4-digit OTP provided by the customer.");
        }

        ride.setStatus(RideStatus.IN_PROGRESS);
        ride.setStartedAt(LocalDateTime.now());
        Ride updated = rideRepository.save(ride);

        recordStatusHistory(updated, RideStatus.ARRIVED, RideStatus.IN_PROGRESS, "Trip started successfully after OTP verification");

        notificationService.sendNotification(
                ride.getCustomer().getId(),
                "Trip Started",
                "Your trip to " + ride.getDestAddress() + " has begun. Ride safely!",
                NotificationType.RIDE_UPDATE
        );

        RideDtos.RideDto dto = toRideDto(updated);
        eventPublisher.publishRideUpdate(rideId, dto);
        return dto;
    }

    @Transactional
    public RideDtos.RideDto captainCompleteTrip(String captainUserId, String rideId) {
        Ride ride = getRideAndVerifyCaptain(captainUserId, rideId);

        if (ride.getStatus() != RideStatus.IN_PROGRESS) {
            throw new BadRequestException("Cannot complete a ride that is not IN_PROGRESS. Current status: " + ride.getStatus());
        }

        ride.setStatus(RideStatus.COMPLETED);
        ride.setCompletedAt(LocalDateTime.now());
        ride.setFinalFare(ride.getEstimatedFare());
        Ride updated = rideRepository.save(ride);

        // Release captain and update captain stats
        CaptainProfile captain = ride.getCaptain();
        captain.setAvailable(true);
        captain.setTotalRides(captain.getTotalRides() + 1);
        captain.setTotalEarnings(captain.getTotalEarnings().add(ride.getFinalFare()));
        captainRepository.save(captain);

        // Update customer profile stats
        customerProfileRepository.findByUserId(ride.getCustomer().getId()).ifPresent(cp -> {
            cp.setTotalRides(cp.getTotalRides() + 1);
            customerProfileRepository.save(cp);
        });

        recordStatusHistory(updated, RideStatus.IN_PROGRESS, RideStatus.COMPLETED,
                "Trip completed successfully. Final fare: ₹" + ride.getFinalFare());

        notificationService.sendNotification(
                ride.getCustomer().getId(),
                "Trip Completed!",
                "You have arrived at your destination. Total fare: ₹" + ride.getFinalFare() + ". Please complete payment.",
                NotificationType.RIDE_UPDATE
        );

        RideDtos.RideDto dto = toRideDto(updated);
        eventPublisher.publishRideUpdate(rideId, dto);
        return dto;
    }

    @Transactional
    public RideDtos.RideDto cancelRide(String userId, String rideId, String reason) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found with id: " + rideId));

        boolean isCustomer = ride.getCustomer().getId().equals(userId);
        boolean isCaptain = ride.getCaptain() != null && ride.getCaptain().getUser().getId().equals(userId);

        if (!isCustomer && !isCaptain) {
            throw new ForbiddenException("You are not authorized to cancel this ride.");
        }

        if (ride.getStatus() == RideStatus.IN_PROGRESS || ride.getStatus() == RideStatus.COMPLETED) {
            throw new BadRequestException("Cannot cancel a trip that is already in progress or completed.");
        }

        RideStatus prevStatus = ride.getStatus();
        ride.setStatus(RideStatus.CANCELLED);
        ride.setCancellationReason(reason);
        ride.setCancelledBy(isCustomer ? "CUSTOMER" : "CAPTAIN");
        Ride updated = rideRepository.save(ride);

        // Release captain if one was assigned
        if (ride.getCaptain() != null) {
            CaptainProfile captain = ride.getCaptain();
            captain.setAvailable(true);
            captainRepository.save(captain);
        }

        recordStatusHistory(updated, prevStatus, RideStatus.CANCELLED,
                "Ride cancelled by " + (isCustomer ? "customer" : "captain") + ". Reason: " + reason);

        String notifyUserId = isCustomer && ride.getCaptain() != null ? ride.getCaptain().getUser().getId() : ride.getCustomer().getId();
        notificationService.sendNotification(
                notifyUserId,
                "Ride Cancelled",
                "Ride was cancelled by " + (isCustomer ? "the customer" : "the captain") + ". Reason: " + reason,
                NotificationType.RIDE_UPDATE
        );

        RideDtos.RideDto dto = toRideDto(updated);
        eventPublisher.publishRideUpdate(rideId, dto);
        return dto;
    }

    @Transactional(readOnly = true)
    public RideDtos.RideDto getRideDetails(String rideId, String userId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found with id: " + rideId));

        boolean isCustomer = ride.getCustomer().getId().equals(userId);
        boolean isCaptain = ride.getCaptain() != null && ride.getCaptain().getUser().getId().equals(userId);

        // Also allow admin to view any ride
        return toRideDto(ride);
    }

    @Transactional(readOnly = true)
    public List<RideDtos.RideDto> getCustomerRides(String customerId) {
        return rideRepository.findByCustomerIdOrderByCreatedAtDesc(customerId)
                .stream().map(this::toRideDto).toList();
    }

    @Transactional(readOnly = true)
    public List<RideDtos.RideDto> getCaptainRides(String captainUserId) {
        CaptainProfile captain = captainRepository.findByUserId(captainUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Captain profile not found"));
        return rideRepository.findByCaptainIdOrderByCreatedAtDesc(captain.getId())
                .stream().map(this::toRideDto).toList();
    }

    @Transactional(readOnly = true)
    public RideDtos.RideDto getActiveCustomerRide(String customerId) {
        List<Ride> active = rideRepository.findActiveRidesForCustomer(customerId);
        return active.isEmpty() ? null : toRideDto(active.get(0));
    }

    @Transactional(readOnly = true)
    public RideDtos.RideDto getActiveCaptainRide(String captainUserId) {
        CaptainProfile captain = captainRepository.findByUserId(captainUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Captain profile not found"));
        List<Ride> active = rideRepository.findActiveRidesForCaptain(captain.getId());
        return active.isEmpty() ? null : toRideDto(active.get(0));
    }

    private Ride getRideAndVerifyCaptain(String captainUserId, String rideId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> new ResourceNotFoundException("Ride not found with id: " + rideId));

        if (ride.getCaptain() == null || !ride.getCaptain().getUser().getId().equals(captainUserId)) {
            throw new ForbiddenException("This ride is not assigned to you.");
        }
        return ride;
    }

    private void recordStatusHistory(Ride ride, RideStatus fromStatus, RideStatus toStatus, String notes) {
        RideStatusHistory history = RideStatusHistory.builder()
                .id(UUID.randomUUID().toString())
                .ride(ride)
                .fromStatus(fromStatus)
                .toStatus(toStatus)
                .notes(notes)
                .build();
        historyRepository.save(history);
    }

    public RideDtos.RideDto toRideDto(Ride r) {
        DateTimeFormatter dtf = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

        String captainName = null;
        String captainPhone = null;
        String captainAvatar = null;
        BigDecimal captainRating = null;
        String captainId = null;
        String vehicleModel = null;
        String regNumber = null;
        String vehicleColor = null;
        BigDecimal captainCurrentLat = null;
        BigDecimal captainCurrentLng = null;

        if (r.getCaptain() != null) {
            CaptainProfile cp = r.getCaptain();
            captainId = cp.getId();
            captainName = cp.getUser().getFullName();
            captainPhone = cp.getUser().getPhone();
            captainAvatar = cp.getUser().getAvatarUrl();
            captainRating = cp.getRatingAvg();
            captainCurrentLat = cp.getCurrentLatitude();
            captainCurrentLng = cp.getCurrentLongitude();

            if (cp.getVehicle() != null) {
                vehicleModel = cp.getVehicle().getModel();
                regNumber = cp.getVehicle().getRegistrationNumber();
                vehicleColor = cp.getVehicle().getColor();
            }
        }

        Payment payment = paymentRepository.findByRideId(r.getId()).orElse(null);
        PaymentMethod paymentMethod = payment != null ? payment.getMethod() : PaymentMethod.CASH;
        PaymentStatus paymentStatus = payment != null ? payment.getStatus() : PaymentStatus.PENDING;

        return new RideDtos.RideDto(
                r.getId(),
                r.getCustomer().getId(),
                r.getCustomer().getFullName(),
                r.getCustomer().getPhone(),
                r.getCustomer().getAvatarUrl(),
                captainId,
                captainName,
                captainPhone,
                captainAvatar,
                captainRating,
                r.getVehicleCategory(),
                vehicleModel,
                regNumber,
                vehicleColor,
                r.getStatus(),
                r.getPickupAddress(),
                r.getPickupLatitude(),
                r.getPickupLongitude(),
                r.getDestAddress(),
                r.getDestLatitude(),
                r.getDestLongitude(),
                r.getDistanceKm(),
                r.getDurationMinutes(),
                r.getEstimatedFare(),
                r.getFinalFare(),
                r.getDiscountAmount(),
                r.getTaxAmount(),
                r.getCouponCode(),
                r.getOtpCode(),
                paymentMethod,
                paymentStatus,
                captainCurrentLat,
                captainCurrentLng,
                r.getCancellationReason(),
                r.getCancelledBy(),
                r.getCreatedAt() != null ? r.getCreatedAt().format(dtf) : null,
                r.getAcceptedAt() != null ? r.getAcceptedAt().format(dtf) : null,
                r.getStartedAt() != null ? r.getStartedAt().format(dtf) : null,
                r.getCompletedAt() != null ? r.getCompletedAt().format(dtf) : null
        );
    }
}
