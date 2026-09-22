package com.xiaoc.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.web.firewall.FirewalledRequest;
import org.springframework.security.web.firewall.StrictHttpFirewall;

public class AdminHttpFirewall extends StrictHttpFirewall {

    private final StrictHttpFirewall literalPercentTool = new StrictHttpFirewall();

    public AdminHttpFirewall() {
        literalPercentTool.setAllowUrlEncodedPercent(true);
    }

    @Override
    public FirewalledRequest getFirewalledRequest(HttpServletRequest request) {
        // Preserve the existing public GET /tools/{slug} contract for the literal '%' slug.
        // Only this exact URL is exempted; encoded admin paths and double encoding stay rejected.
        if ("GET".equals(request.getMethod())
                && (request.getContextPath() + "/api/tools/%25").equals(request.getRequestURI())) {
            return literalPercentTool.getFirewalledRequest(request);
        }
        return super.getFirewalledRequest(request);
    }
}
