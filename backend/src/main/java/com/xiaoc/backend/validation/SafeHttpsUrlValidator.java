package com.xiaoc.backend.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

public class SafeHttpsUrlValidator implements ConstraintValidator<SafeHttpsUrl, String> {
    private boolean microsoftOnly;

    @Override
    public void initialize(SafeHttpsUrl constraint) {
        microsoftOnly = constraint.microsoftOnly();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isEmpty()) return true;
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null
                    || uri.getRawUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
                return false;
            }
            host = host.toLowerCase(Locale.ROOT);
            return !microsoftOnly || host.equals("microsoft.com") || host.endsWith(".microsoft.com");
        } catch (URISyntaxException exception) {
            return false;
        }
    }
}
