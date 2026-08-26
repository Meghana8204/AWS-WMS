package com.ams.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Dedicated Authentication Server. This is the ONLY Java deployable unit
 * left after the migration - see /docs/ARCHITECTURE.md. It contains no
 * business logic: authentication, JWT issuance/validation, RBAC, refresh
 * tokens, user management, and audit logging only.
 */
@SpringBootApplication(scanBasePackages = {"com.ams.auth", "com.ams.common"})
@ConfigurationPropertiesScan
public class AuthServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }
}
