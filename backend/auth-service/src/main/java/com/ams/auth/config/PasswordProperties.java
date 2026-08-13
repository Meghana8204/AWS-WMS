package com.ams.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ams.security.password")
public record PasswordProperties(int bcryptStrength) {}
