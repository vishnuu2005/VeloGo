package com.velogo.config;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

@Component
public class DatabaseHealthIndicator implements HealthIndicator {

    private final DataSource dataSource;

    public DatabaseHealthIndicator(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Health health() {
        try (Connection connection = dataSource.getConnection()) {
            if (connection.isValid(2)) {
                return Health.up()
                        .withDetail("database", "VeloGo Database")
                        .withDetail("status", "Available")
                        .build();
            } else {
                return Health.down()
                        .withDetail("database", "Connection timeout")
                        .build();
            }
        } catch (Exception ex) {
            return Health.down(ex)
                    .withDetail("database", "Error establishing connection")
                    .build();
        }
    }
}
