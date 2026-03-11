-- ====================================
-- 初始化管理员账户脚本
-- 用于在 Supabase 中创建第一个管理员账户
-- ====================================

-- 使用说明：
-- 1. 在 Supabase Dashboard -> Authentication -> Users 中创建一个用户
--    Email: admin@warehouse.local
--    Password: admin123 (请修改为强密码)
--    勾选 "Auto Confirm User"
-- 
-- 2. 复制新创建用户的 ID (UUID 格式)
-- 
-- 3. 将下面的 USER_ID_HERE 替换为您的用户 ID
-- 
-- 4. 在 SQL Editor 中运行此脚本
-- ====================================

-- TODO: 将这里的 UUID 替换为您的实际用户 ID
DO $$
DECLARE
  v_user_id UUID := 'YOUR_USER_ID_HERE';  -- 替换这里
  v_warehouse_id UUID;
BEGIN
  -- 获取第一个仓库的 ID（如果没有，请先创建仓库）
  SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;
  
  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION '没有找到仓库，请先在 warehouses 表中创建仓库';
  END IF;
  
  -- 更新或创建管理员档案
  INSERT INTO profiles (id, username, password_hash, role, warehouse_ids, language, display_name_zh, display_name_en)
  VALUES (
    v_user_id,
    'admin',
    '$2a$10$dummyhash',  -- 密码由 Supabase Auth 管理
    'admin',  -- 管理员角色
    ARRAY[v_warehouse_id]::UUID[],  -- 管理所有仓库
    'zh',
    '系统管理员',
    'System Administrator'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
   warehouse_ids = ARRAY[v_warehouse_id]::UUID[],
    username = 'admin',
    updated_at = now();
  
  RAISE NOTICE '管理员账户创建成功！';
  RAISE NOTICE '用户名：admin';
  RAISE NOTICE '仓库：% ', v_warehouse_id;
END $$;

-- ====================================
-- 查询当前所有用户及其权限
-- ====================================
SELECT 
  p.id,
  p.username,
  p.role,
  CASE 
    WHEN p.warehouse_ids IS NULL THEN '所有仓库'
    WHEN array_length(p.warehouse_ids, 1) IS NULL THEN '无仓库权限'
    ELSE string_agg(w.name_zh, ', ')
  END as warehouses,
  p.language,
  p.display_name_zh,
  p.created_at
FROM profiles p
LEFT JOIN LATERAL unnest(p.warehouse_ids) AS wid ON true
LEFT JOIN warehouses w ON w.id = wid
GROUP BY p.id, p.username, p.role, p.warehouse_ids, p.language, p.display_name_zh, p.created_at
ORDER BY p.created_at DESC;

-- ====================================
-- 常用命令示例
-- ====================================

-- 将用户升级为管理员：
-- UPDATE profiles SET role = 'admin' WHERE username = '用户名';

-- 将用户降级为普通用户：
-- UPDATE profiles SET role = 'user' WHERE username = '用户名';

-- 为用户添加仓库权限：
-- UPDATE profiles SET warehouse_ids = array_append(warehouse_ids, '仓库-ID') WHERE username = '用户名';

-- 删除用户档案：
-- DELETE FROM profiles WHERE username = '用户名';
