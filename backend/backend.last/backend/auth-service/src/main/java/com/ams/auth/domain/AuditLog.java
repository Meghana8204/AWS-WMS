package com.ams.auth.domain;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Append-only security audit trail: logins, logouts, failed attempts,
 * user/role changes. Required by the "Audit Logs" scope of auth-service.
 */
@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    private UUID id;

    private UUID userId;

    @Column(nullable = false)
    private String eventType;

    @Column(nullable = false)
    private String detail;

    @Column(nullable = false)
    private Instant occurredAt;

    protected AuditLog() {
        // required by JPA
    }

    public AuditLog(UUID userId, String eventType, String detail) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.eventType = eventType;
        this.detail = detail;
        this.occurredAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getEventType() { return eventType; }
    public String getDetail() { return detail; }
    public Instant getOccurredAt() { return occurredAt; }
}
