package com.xiaoc.backend.security;

import com.xiaoc.backend.entity.AdminUser;
import com.xiaoc.backend.vo.AdminUserVO;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.userdetails.User;

public class AdminPrincipal extends User {

    private final Long id;
    private final String nickname;

    public AdminPrincipal(AdminUser admin) {
        super(admin.getUsername(), admin.getPassword(), Integer.valueOf(1).equals(admin.getStatus()),
                true, true, true, AuthorityUtils.createAuthorityList("ROLE_ADMIN"));
        this.id = admin.getId();
        this.nickname = admin.getNickname();
    }

    public AdminUserVO toVO() {
        return new AdminUserVO(id, getUsername(), nickname);
    }
}
