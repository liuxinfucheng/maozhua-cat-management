import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { Layout, Menu, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { PawIcon } from "../components/PawIcon";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const pageMeta: Record<string, { title: string; description: string }> = {
  "/": {
    title: "首页",
    description: "猫爪猫咪管理后台",
  },
  "/cats": {
    title: "猫咪成员管理",
    description: "管理和维护猫咪成员信息",
  },
  "/import": {
    title: "导入数据",
    description: "从 Excel 文件导入猫咪成员数据",
  },
  "/export": {
    title: "导出数据",
    description: "将猫咪成员数据导出为 Excel 文件",
  },
};

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = pageMeta[location.pathname] ?? pageMeta["/"];
  const selectedKeys = location.pathname === "/" ? [] : [location.pathname];

  return (
    <Layout className="app-shell">
      <Sider width={220} className="app-sider">
        <button className="brand" type="button" onClick={() => navigate("/")}>
          <span className="brand-mark" aria-hidden="true">
            <PawIcon />
          </span>
          <span className="brand-copy">
            <Text className="brand-name">猫爪</Text>
            <Text className="brand-caption">猫咪管理后台</Text>
          </span>
        </button>

        <div className="nav-label">功能导航</div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          onClick={({ key }) => navigate(key)}
          items={[
            {
              key: "/cats",
              icon: <PawIcon />,
              label: "猫咪成员管理",
            },
            {
              key: "/import",
              icon: <UploadOutlined />,
              label: "导入数据",
            },
            {
              key: "/export",
              icon: <DownloadOutlined />,
              label: "导出数据",
            },
          ]}
        />

        <div className="sider-footer">
          <span className="status-dot" />
          <Text>本地离线模式</Text>
        </div>
      </Sider>

      <Layout>
        <Content className="main-content">
          <header className="page-header">
            <div>
              <Title level={3}>{currentPage.title}</Title>
              <Text type="secondary">{currentPage.description}</Text>
            </div>
          </header>

          <section
            className="page-canvas"
            aria-label={`${currentPage.title}内容区域`}
          >
            <Outlet />
          </section>
        </Content>
      </Layout>
    </Layout>
  );
}
