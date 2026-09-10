import { Spin } from "antd";
import { lazy, Suspense } from "react";
import { createHashRouter } from "react-router-dom";
import { MainLayout } from "../layouts/MainLayout";
import { CatMembersPage } from "../pages/CatMembersPage";
import { HomePage } from "../pages/HomePage";

const ImportDataPage = lazy(() =>
  import("../pages/ImportDataPage").then((module) => ({
    default: module.ImportDataPage,
  })),
);

const ExportDataPage = lazy(() =>
  import("../pages/ExportDataPage").then((module) => ({
    default: module.ExportDataPage,
  })),
);

export const router = createHashRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "cats",
        element: <CatMembersPage />,
      },
      {
        path: "import",
        element: (
          <Suspense fallback={<div className="route-loading"><Spin /></div>}>
            <ImportDataPage />
          </Suspense>
        ),
      },
      {
        path: "export",
        element: (
          <Suspense fallback={<div className="route-loading"><Spin /></div>}>
            <ExportDataPage />
          </Suspense>
        ),
      },
    ],
  },
]);
