package com.ams.auth.service;

import com.ams.auth.config.JwtProperties;
import com.ams.auth.domain.RefreshToken;
import com.ams.auth.domain.User;
import com.ams.auth.dto.LoginRequest;
import com.ams.auth.dto.TokenResponse;
import com.ams.auth.jwt.JwtTokenProvider;
import com.ams.auth.repository.RefreshTokenRepository;
import com.ams.auth.repository.UserRepository;
import com.ams.common.domain.NotFoundException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;

/**
 * Login / logout / refresh - the core of the auth server. Access tokens
 * are short-lived RS256 JWTs (see JwtTokenProvider); refresh tokens are
 * opaque random values, stored only as a SHA-256 hash, rotated on every
 * use (the old one is revoked the moment a new one is issued).
 */
@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtProperties jwtProperties;
    private final AuditService auditService;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(AuthenticationManager authenticationManager, UserRepository userRepository,
                        RefreshTokenRepository refreshTokenRepository, JwtTokenProvider jwtTokenProvider,
                        JwtProperties jwtProperties, AuditService auditService) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtTokenProvider = jwtTokenProvider;
        this.jwtProperties = jwtProperties;
        this.auditService = auditService;
    }

    @Transactional
    public TokenResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        } catch (org.springframework.security.core.AuthenticationException e) {
            auditService.record(null, "LOGIN_FAILED", "username=" + request.username());
            throw new BadCredentialsException("Invalid username or password");
        }

        User user = userRepository.findByUsername(request.username())
            .orElseThrow(() -> new NotFoundException("User not found: " + request.username()));

        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String refreshTokenValue = issueRefreshToken(user.getId());

        auditService.record(user.getId(), "LOGIN_SUCCESS", "username=" + user.getUsername());

        return TokenResponse.bearer(accessToken, refreshTokenValue, jwtProperties.accessTokenTtlMinutes() * 60L);
    }

    @Transactional
    public TokenResponse refresh(String presentedRefreshToken) {
        String hash = sha256(presentedRefreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
            .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));

        if (!stored.isValid(Instant.now())) {
            throw new BadCredentialsException("Refresh token expired or revoked");
        }

        // Rotate: revoke the presented token, issue a brand new one. A
        // replayed (already-used) refresh token can never succeed twice.
        stored.revoke();
        refreshTokenRepository.save(stored);

        User user = userRepository.findById(stored.getUserId())
            .orElseThrow(() -> new NotFoundException("User not found"));

        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String newRefreshToken = issueRefreshToken(user.getId());

        auditService.record(user.getId(), "TOKEN_REFRESHED", "username=" + user.getUsername());

        return TokenResponse.bearer(accessToken, newRefreshToken, jwtProperties.accessTokenTtlMinutes() * 60L);
    }

    @Transactional
    public void logout(UUID userId, String presentedRefreshToken) {
        String hash = sha256(presentedRefreshToken);
        refreshTokenRepository.findByTokenHash(hash).ifPresent(token -> {
            token.revoke();
            refreshTokenRepository.save(token);
        });
        auditService.record(userId, "LOGOUT", "");
    }

    private String issueRefreshToken(UUID userId) {
        byte[] randomBytes = new byte[64];
        secureRandom.nextBytes(randomBytes);
        String tokenValue = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        Instant now = Instant.now();
        RefreshToken refreshToken = new RefreshToken(
            userId, sha256(tokenValue), now, now.plus(jwtProperties.refreshTokenTtlDays(), ChronoUnit.DAYS));
        refreshTokenRepository.save(refreshToken);
        return tokenValue;
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
