package com.xiaoc.backend.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.xiaoc.backend.dto.AdminWindowsSaveRequest;
import com.xiaoc.backend.entity.WindowsVersion;
import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.mapper.WindowsVersionMapper;
import com.xiaoc.backend.vo.AdminWindowsVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminWindowsService {

    private final WindowsVersionMapper mapper;

    public List<AdminWindowsVO> list() {
        return mapper.selectList(new LambdaQueryWrapper<WindowsVersion>()
                .orderByAsc(WindowsVersion::getSortOrder, WindowsVersion::getId))
                .stream().map(this::toVO).toList();
    }

    public AdminWindowsVO detail(long id) {
        return toVO(require(id));
    }

    @Transactional
    public AdminWindowsVO create(AdminWindowsSaveRequest request) {
        WindowsVersion entity = new WindowsVersion();
        entity.setName(request.name());
        entity.setVersion(request.version());
        entity.setEdition(request.edition());
        entity.setArchitecture(request.architecture());
        entity.setReleaseDate(request.releaseDate());
        entity.setDescription(request.description());
        entity.setOfficialDownloadUrl(request.officialDownloadUrl());
        entity.setSha256(request.sha256());
        entity.setImageUrl(request.imageUrl());
        entity.setStatus(request.status());
        entity.setSortOrder(request.sortOrder());
        mapper.insert(entity);
        return detail(entity.getId());
    }

    @Transactional
    public AdminWindowsVO update(long id, AdminWindowsSaveRequest request) {
        require(id);
        // Explicit SET also clears nullable fields; timestamps and viewCount stay database-owned.
        mapper.update(null, new LambdaUpdateWrapper<WindowsVersion>()
                .eq(WindowsVersion::getId, id)
                .set(WindowsVersion::getName, request.name())
                .set(WindowsVersion::getVersion, request.version())
                .set(WindowsVersion::getEdition, request.edition())
                .set(WindowsVersion::getArchitecture, request.architecture())
                .set(WindowsVersion::getReleaseDate, request.releaseDate())
                .set(WindowsVersion::getDescription, request.description())
                .set(WindowsVersion::getOfficialDownloadUrl, request.officialDownloadUrl())
                .set(WindowsVersion::getSha256, request.sha256())
                .set(WindowsVersion::getImageUrl, request.imageUrl())
                .set(WindowsVersion::getStatus, request.status())
                .set(WindowsVersion::getSortOrder, request.sortOrder()));
        return detail(id);
    }

    @Transactional
    public void delete(long id) {
        if (mapper.deleteById(id) == 0) {
            throw new ResourceNotFoundException("Windows resource not found");
        }
    }

    private WindowsVersion require(long id) {
        WindowsVersion entity = mapper.selectById(id);
        if (entity == null) {
            throw new ResourceNotFoundException("Windows resource not found");
        }
        return entity;
    }

    private AdminWindowsVO toVO(WindowsVersion entity) {
        return new AdminWindowsVO(
                entity.getId(),
                entity.getName(),
                entity.getVersion(),
                entity.getEdition(),
                entity.getArchitecture(),
                entity.getReleaseDate(),
                entity.getDescription(),
                entity.getOfficialDownloadUrl(),
                entity.getSha256(),
                entity.getImageUrl(),
                entity.getStatus(),
                entity.getSortOrder(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
