package com.xiaoc.backend.service;

import com.xiaoc.backend.vo.WindowsVersionDetailVO;
import com.xiaoc.backend.vo.WindowsVersionListVO;

import java.util.List;

public interface WindowsVersionService {

    List<WindowsVersionListVO> listPublicVersions();

    WindowsVersionDetailVO getPublicVersion(long id);
}
