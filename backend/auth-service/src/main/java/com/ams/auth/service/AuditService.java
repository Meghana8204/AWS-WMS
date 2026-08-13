package com.ams.auth.service;

import com.ams.auth.domain.AuditLog;
import com.ams.auth.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void record(UUID userId, String eventType, String detail) {
        auditLogRepository.save(new AuditLog(userId, eventType, detail));
    }
}
