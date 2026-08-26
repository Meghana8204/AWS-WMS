package com.ams.auth.jwt;

import com.ams.auth.config.JwtProperties;
import com.ams.auth.domain.Permission;
import com.ams.auth.domain.Role;
import com.ams.auth.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Issues and validates the RS256 access token. Claims include roles and
 * flattened permissions, so the Python business-service can authorize
 * requests LOCALLY (see business-service/app/security/dependencies.py)
 * without calling back into this service on every request - it only fetches
 * (and caches) the public key via /.well-known/jwks.json.
 */
@Component
public class JwtTokenProvider {

    private final JwtKeyProvider keyProvider;
    private final JwtProperties properties;

    public JwtTokenProvider(JwtKeyProvider keyProvider, JwtProperties properties) {
        this.keyProvider = keyProvider;
        this.properties = properties;
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiry = now.plus(properties.accessTokenTtlMinutes(), ChronoUnit.MINUTES);

        List<String> roleNames = user.getRoles().stream().map(Role::getName).collect(Collectors.toList());
        List<String> permissionNames = user.getRoles().stream()
            .flatMap(r -> r.getPermissions().stream())
            .map(Permission::getName)
            .distinct()
            .collect(Collectors.toList());

        return Jwts.builder()
            .setHeaderParam("kid", keyProvider.keyId())
            .setIssuer(properties.issuer())
            .setAudience(properties.audience())
            .setSubject(user.getId().toString())
            .claim("username", user.getUsername())
            .claim("roles", roleNames)
            .claim("permissions", permissionNames)
            .setIssuedAt(java.util.Date.from(now))
            .setExpiration(java.util.Date.from(expiry))
            .signWith(keyProvider.privateKey(), SignatureAlgorithm.RS256)
            .compact();
    }

    public Claims parseAndValidate(String token) {
        try {
            return Jwts.parserBuilder()
                .setSigningKey(keyProvider.publicKey())
                .requireIssuer(properties.issuer())
                .requireAudience(properties.audience())
                .build()
                .parseClaimsJws(token)
                .getBody();
        } catch (JwtException e) {
            throw new InvalidTokenException("Invalid or expired access token", e);
        }
    }

    public Map<String, Object> jwksDocument() {
        com.nimbusds.jose.jwk.RSAKey rsaKey = new com.nimbusds.jose.jwk.RSAKey.Builder(keyProvider.publicKey())
            .keyID(keyProvider.keyId())
            .algorithm(com.nimbusds.jose.JWSAlgorithm.RS256)
            .keyUse(com.nimbusds.jose.jwk.KeyUse.SIGNATURE)
            .build();
        return Map.of("keys", List.of(rsaKey.toJSONObject()));
    }
}
