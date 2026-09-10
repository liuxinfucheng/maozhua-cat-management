import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#e79075",
          colorText: "#403a38",
          colorTextSecondary: "#8c817d",
          colorBgLayout: "#f8f6f4",
          colorBorderSecondary: "#eee8e4",
          borderRadius: 12,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif",
        },
        components: {
          Layout: {
            siderBg: "#fffaf7",
            bodyBg: "#f8f6f4",
          },
          Menu: {
            itemBg: "transparent",
            itemSelectedBg: "#f8e8e1",
            itemSelectedColor: "#b85f46",
            itemColor: "#665d59",
            itemBorderRadius: 10,
          },
        },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

export default App;
