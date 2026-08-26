package com.ams.auth.service;

import com.ams.auth.domain.Role;
import com.ams.auth.domain.User;
import com.ams.auth.dto.CreateUserRequest;
import com.ams.common.domain.DomainRuleViolationException;
import com.ams.common.domain.NotFoundException;
import com.ams.auth.repository.RoleRepository;
import com.ams.auth.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;



@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserService(UserRepository userRepository, RoleRepository roleRepository,
                        PasswordEncoder passwordEncoder, AuditService auditService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional
    public User createUser(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new DomainRuleViolationException("Username already taken: " + request.username());
        }
        User user = new User(request.username(), passwordEncoder.encode(request.password()));
        for (String roleName : request.roles()) {
            Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new NotFoundException("Role not found: " + roleName));
            user.addRole(role);
        }
        User saved = userRepository.save(user);
        auditService.record(saved.getId(), "USER_CREATED", "username=" + saved.getUsername());
        return saved;
    }

    public List<User> listUsers() {
        return userRepository.findAll();
    }

    public User getUser(UUID id) {
        return userRepository.findById(id).orElseThrow(() -> new NotFoundException("User not found: " + id));
    }

    @Transactional
    public void disableUser(UUID id) {
        User user = getUser(id);
        user.setEnabled(false);
        userRepository.save(user);
        auditService.record(id, "USER_DISABLED", "username=" + user.getUsername());
    }
}
