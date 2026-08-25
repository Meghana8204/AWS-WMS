package com.ams.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record CreateUserRequest(
    @NotBlank String username,
    @NotBlank String password,
    @NotEmpty List<String> roles
) {}
