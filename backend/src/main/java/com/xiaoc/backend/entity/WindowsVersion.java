package com.xiaoc.backend.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@TableName("windows_version")
public class WindowsVersion {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String version;

    private String edition;

    private String architecture;

    private LocalDate releaseDate;

    private String description;

    private String officialDownloadUrl;

    private String sha256;

    private String imageUrl;

    private Integer status;

    private Integer sortOrder;

    // Database defaults and ON UPDATE own these timestamps.
    @TableField(insertStrategy = FieldStrategy.NEVER, updateStrategy = FieldStrategy.NEVER)
    private LocalDateTime createdAt;

    @TableField(insertStrategy = FieldStrategy.NEVER, updateStrategy = FieldStrategy.NEVER)
    private LocalDateTime updatedAt;
}
