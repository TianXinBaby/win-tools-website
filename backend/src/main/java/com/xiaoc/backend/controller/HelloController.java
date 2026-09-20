package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HelloController {

    @GetMapping("/hello")
    public ApiResponse<String> hello() {
        return ApiResponse.success("Hello Win Tools!");
    }
}
