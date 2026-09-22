package com.xiaoc.backend.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = SafeHttpsUrlValidator.class)
public @interface SafeHttpsUrl {
    String message() default "Invalid HTTPS URL";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
    boolean microsoftOnly() default false;
}
