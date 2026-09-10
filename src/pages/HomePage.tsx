import { Typography } from "antd";
import { PawIcon } from "../components/PawIcon";

const { Title } = Typography;

export function HomePage() {
  return (
    <div className="home-page">
      <span className="home-page-icon" aria-hidden="true">
        <PawIcon />
      </span>
      <Title level={2}>欢迎进入猫爪管理后台</Title>
    </div>
  );
}
