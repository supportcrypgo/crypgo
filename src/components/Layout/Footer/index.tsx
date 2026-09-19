import React, { FC } from "react";
import Link from "next/link";
import { headerData } from "../Header/Navigation/menuData";
import { footerlabels } from "@/app/api/data";
import Logo from "../Header/Logo";

const Footer: FC = () => {
  return (
    <footer className="pt-16 bg-darkmode">
      <div className="container mx-auto lg:max-w-screen-xl md:max-w-screen-md px-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 lg:gap-20 md:gap-6 sm:gap-12 gap-6  pb-16">
          <div className="lg:col-span-4 md:col-span-6 col-span-6">
            <Logo />
            <p className="text-muted text-opacity-70 text-17 mt-8 max-w-xs">
              A clearer way to manage your crypto portfolio and wallet activity.
            </p>
            <h3 className="text-white text-24 font-medium sm:mt-20 mt-12">
              2026 Copyright | Crypgo
            </h3>
          </div>
          <div className="lg:col-span-2 md:col-span-3 col-span-6">
            <h4 className="text-white mb-4 font-medium text-24">Links</h4>
            <ul>
              {headerData.map((item, index) => (
                <li key={index} className="pb-4">
                  <Link
                    href={item.href}
                    className="text-white hover:text-primary text-17"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-2 md:col-span-3 col-span-6">
            <h4 className="text-white mb-4 font-medium text-24">Information</h4>
            <ul>
              {footerlabels.map((item, index) => (
                <li key={index} className="pb-4">
                  <Link
                    href={item.herf}
                    className="text-white hover:text-primary text-17"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-4 md:col-span-4 col-span-6">
            <h3 className="text-white text-24 font-medium">Ready when you are</h3>
            <p className="text-muted text-opacity-60 text-18 mt-5">
              Sign in to review your portfolio or create a new Crypgo account.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link href="/?signin=1" className="text-primary border border-primary px-4 py-2 rounded-lg hover:bg-primary hover:text-darkmode">
                Sign in
              </Link>
              <Link href="/?signup=1" className="text-darkmode bg-primary border border-primary px-4 py-2 rounded-lg hover:bg-transparent hover:text-primary">
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
