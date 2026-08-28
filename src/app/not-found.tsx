import Breadcrumb from "@/components/Common/Breadcrumb";

export const dynamic = 'force-dynamic';

import NotFound from "@/components/NotFound";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 Page | Crypgo",
};

const ErrorPage = () => {
  return (
    <>
      <Breadcrumb pageName="404" pageDescription="Page not found" />
      <NotFound />
    </>
  );
};

export default ErrorPage;
