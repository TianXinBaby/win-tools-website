package com.xiaoc.backend.exception;

public class VideoConversionException extends RuntimeException {
    private final int status;
    public VideoConversionException(int status, String code) {
        super(code);
        this.status = status;
    }
    public int status() { return status; }
}
