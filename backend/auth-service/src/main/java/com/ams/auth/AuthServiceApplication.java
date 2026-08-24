package com.ams.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;



@SpringBootApplication(scanBasePackages = {"com.ams.auth", "com.ams.common"})
@ConfigurationPropertiesScan
public class AuthServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }
}
