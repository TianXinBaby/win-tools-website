package com.xiaoc.backend.controller;

import com.xiaoc.backend.common.ApiResponse;
import com.xiaoc.backend.service.VideoConverterService;
import jakarta.servlet.http.HttpSession;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/tools/video-converter")
public class VideoConverterController {
    private final VideoConverterService service;
    public VideoConverterController(VideoConverterService service) { this.service = service; }

    @GetMapping("/capabilities")
    public ResponseEntity<?> capabilities() { return json(service.capabilities()); }

    @PostMapping(value = "/jobs", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> create(@RequestParam MultipartFile file, @RequestParam String targetFormat,
                                    HttpSession session) {
        return json(service.submit(file, targetFormat, owner(session)));
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<?> status(@PathVariable String jobId, HttpSession session) {
        return json(service.status(jobId, owner(session)));
    }

    @DeleteMapping("/jobs/{jobId}")
    public ResponseEntity<?> cancel(@PathVariable String jobId, HttpSession session) {
        return json(service.cancel(jobId, owner(session)));
    }

    @GetMapping("/jobs/{jobId}/download")
    public ResponseEntity<Resource> download(@PathVariable String jobId, HttpSession session) {
        var download = service.download(jobId, owner(session));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_OCTET_STREAM).contentLength(download.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.filename()).build().toString())
                .body(download.resource());
    }

    private ResponseEntity<?> json(Object data) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success(data));
    }

    private String owner(HttpSession session) {
        synchronized (session) {
            String attribute = VideoConverterController.class.getName() + ".owner";
            String owner = (String) session.getAttribute(attribute);
            if (owner == null) { owner = UUID.randomUUID().toString(); session.setAttribute(attribute, owner); }
            return owner;
        }
    }
}
