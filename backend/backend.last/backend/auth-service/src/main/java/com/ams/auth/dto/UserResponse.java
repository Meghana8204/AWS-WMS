package com.ams.auth.dto;

import com.ams.auth.domain.Role;
import com.ams.auth.domain.User;

import java.util.List;
import java.util.stream.Collectors;

public record UserResponse(String id, String username, boolean enabled, List<String> roles) {
    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId().toString(),
            user.getUsername(),
            user.isEnabled(),
            user.getRoles().stream().map(Role::getName).collect(Collectors.toList())
        );
    }
}
