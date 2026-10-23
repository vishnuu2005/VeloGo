import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FareCard } from '../FareCard';
import { CategoryEstimate } from '../../types';

describe('FareCard Component', () => {
  const mockEstimate: CategoryEstimate = {
    category: 'BIKE',
    categoryName: 'VeloGo Bike',
    etaText: '2 mins away',
    distanceKm: 4.5,
    durationMinutes: 12,
    baseFare: 25.0,
    distanceCharge: 40.5,
    timeCharge: 18.0,
    bookingFee: 5.0,
    taxAmount: 4.43,
    discountAmount: 20.0,
    totalFare: 72.93,
    isAvailable: true,
  };

  it('renders category name, estimated fare, and live ETA tag', () => {
    const handleSelect = vi.fn();
    render(<FareCard estimate={mockEstimate} isSelected={false} onSelect={handleSelect} />);

    expect(screen.getByText('VeloGo Bike')).toBeInTheDocument();
    expect(screen.getByText('₹72.93')).toBeInTheDocument();
    expect(screen.getByText('2 mins away')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const handleSelect = vi.fn();
    render(<FareCard estimate={mockEstimate} isSelected={false} onSelect={handleSelect} />);

    fireEvent.click(screen.getByText('VeloGo Bike'));
    expect(handleSelect).toHaveBeenCalledTimes(1);
  });

  it('toggles fare breakdown on click', () => {
    const handleSelect = vi.fn();
    render(<FareCard estimate={mockEstimate} isSelected={true} onSelect={handleSelect} />);

    const breakdownBtn = screen.getByText(/Breakdown/i);
    fireEvent.click(breakdownBtn);

    expect(screen.getByText('Base Fare')).toBeInTheDocument();
    expect(screen.getByText('Platform & Safety Fee')).toBeInTheDocument();
    expect(screen.getByText('Promotional Discount')).toBeInTheDocument();
  });
});
