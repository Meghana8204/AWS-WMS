package com.ams.auth.jwt;

import com.ams.auth.config.JwtProperties;
import org.springframework.core.io.support.ResourcePatternUtils;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Loads the RSA keypair used to sign (private key) and verify / publish via
 * JWKS (public key) access tokens. Paths are Spring resource locations
 * (classpath: for local dev keys, file: for a mounted Kubernetes secret in
 * every real environment - see deploy/k8s/base/auth-secrets.yaml).
 */
@Component
public class JwtKeyProvider {

    private final RSAPrivateKey privateKey;
    private final RSAPublicKey publicKey;
    private final String keyId;

    public JwtKeyProvider(JwtProperties properties) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        this.privateKey = loadPrivateKey(properties.privateKeyPath());
        this.publicKey = loadPublicKey(properties.publicKeyPath());
        this.keyId = properties.keyId();
    }

    public RSAPrivateKey privateKey() { return privateKey; }
    public RSAPublicKey publicKey() { return publicKey; }
    public String keyId() { return keyId; }

    private RSAPrivateKey loadPrivateKey(String path) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String pem = readPem(path, "PRIVATE KEY");
        byte[] decoded = Base64.getDecoder().decode(pem);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(decoded);
        return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(spec);
    }

    private RSAPublicKey loadPublicKey(String path) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String pem = readPem(path, "PUBLIC KEY");
        byte[] decoded = Base64.getDecoder().decode(pem);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(decoded);
        return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
    }

    private String readPem(String location, String marker) throws IOException {
        try (InputStream is = ResourcePatternUtils.getResourcePatternResolver(null).getResource(location).getInputStream()) {
            String raw = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            return raw
                .replace("-----BEGIN " + marker + "-----", "")
                .replace("-----END " + marker + "-----", "")
                .replaceAll("\\s", "");
        }
    }
}
