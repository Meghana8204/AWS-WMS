package com.ams.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ams.security.jwt")
public record JwtProperties(
    String issuer,
    String audience,
    int accessTokenTtlMinutes,
    int refreshTokenTtlDays,
    String privateKeyPath,
    String publicKeyPath,
    String keyId
) {}
