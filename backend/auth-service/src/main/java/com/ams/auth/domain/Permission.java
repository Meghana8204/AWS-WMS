package com.ams.auth.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;



@Entity
@Table(name = "permission")
public class Permission {

    @Id
    private UUID id;

    private String name;

    protected Permission() {

    }

    public Permission(String name) {
        this.id = UUID.randomUUID();
        this.name = name;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
}
