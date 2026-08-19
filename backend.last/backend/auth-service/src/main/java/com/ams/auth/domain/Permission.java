package com.ams.auth.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * A fine-grained permission such as "receiving:write" or "returns:read".
 * These are the exact strings embedded in the "permissions" claim of every
 * access token, and the exact strings the Python business-service checks
 * with require_permission(...) - see business-service/app/security/dependencies.py.
 */
@Entity
@Table(name = "permission")
public class Permission {

    @Id
    private UUID id;

    private String name;

    protected Permission() {
        // required by JPA
    }

    public Permission(String name) {
        this.id = UUID.randomUUID();
        this.name = name;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
}
