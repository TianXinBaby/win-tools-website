package com.xiaoc.backend.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.xiaoc.backend.entity.WindowsVersion;
import com.xiaoc.backend.exception.ResourceNotFoundException;
import com.xiaoc.backend.mapper.WindowsVersionMapper;
import com.xiaoc.backend.service.WindowsVersionService;
import com.xiaoc.backend.vo.WindowsVersionDetailVO;
import com.xiaoc.backend.vo.WindowsVersionListVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WindowsVersionServiceImpl implements WindowsVersionService {

    private final WindowsVersionMapper windowsVersionMapper;

    @Override
    public List<WindowsVersionListVO> listPublicVersions() {
        return windowsVersionMapper.selectList(new LambdaQueryWrapper<WindowsVersion>()
                        .eq(WindowsVersion::getStatus, 1)
                        .orderByAsc(WindowsVersion::getSortOrder)
                        .orderByDesc(WindowsVersion::getReleaseDate)
                        .orderByAsc(WindowsVersion::getId))
                .stream().map(this::toListVO).toList();
    }

    @Override
    public WindowsVersionDetailVO getPublicVersion(long id) {
        if (id <= 0) {
            throw new ResourceNotFoundException("Windows resource not found");
        }
        WindowsVersion version = windowsVersionMapper.selectOne(new LambdaQueryWrapper<WindowsVersion>()
                .eq(WindowsVersion::getId, id)
                .eq(WindowsVersion::getStatus, 1));
        if (version == null) {
            throw new ResourceNotFoundException("Windows resource not found");
        }
        return toDetailVO(version);
    }

    private WindowsVersionListVO toListVO(WindowsVersion version) {
        return new WindowsVersionListVO(
                version.getId(), version.getName(), version.getVersion(), version.getEdition(),
                version.getArchitecture(), version.getReleaseDate(), version.getDescription(), version.getImageUrl());
    }

    private WindowsVersionDetailVO toDetailVO(WindowsVersion version) {
        return new WindowsVersionDetailVO(
                version.getId(), version.getName(), version.getVersion(), version.getEdition(),
                version.getArchitecture(), version.getReleaseDate(), version.getDescription(),
                version.getOfficialDownloadUrl(), version.getSha256(), version.getImageUrl());
    }
}
