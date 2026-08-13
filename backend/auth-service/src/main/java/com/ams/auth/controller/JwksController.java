package com.ams.auth.controller;

import com.ams.auth.jwt.JwtTokenProvider;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Publishes this service's RSA public key as a standard JWKS document.
 * The Python business-service fetches and caches this (see
 * business-service/app/security/jwt.py) so it can validate access tokens
 * locally instead of calling this service on every request.
 */
@RestController
public class JwksController {

    private final JwtTokenProvider jwtTokenProvider;

    public JwksController(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @GetMapping("/.well-known/jwks.json")
    public ResponseEntity<Map<String, Object>> jwks() {
        return ResponseEntity.ok(jwtTokenProvider.jwksDocument());
    }
}
