// src/App.jsx
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import AbstractArt from "./components/AbstractArt";
import HowItWorks from "./components/HowItWorks";
import AboutSection from "./components/AboutSection";
import FooterArt from "./components/FooterArt";
import Footer from "./components/Footer";
import Account from "./components/Account";
import Signup from "./components/Signup";
import Login from "./components/Login";
import EditScript from "./components/EditScript";
import Create from "./components/CreatePro";
import Preview from "./components/Preview";
import Episodes from "./components/Episodes";
import EditPodcast from "./components/editPodcast.jsx";
import FinalizePublish from "./components/FinalizePublish";
import EmailAction from "./components/EmailAction";
import Share from "./components/Share";
import { syncCreateDraftLease } from "./utils/createDraftSession";



function isAuthenticated() {
  return !!(
    localStorage.getItem("token") || sessionStorage.getItem("token")
  );
}

function useHashRoute() {
  const resolveRoute = () => {
    const hash = window.location.hash || "";
    if (hash) {
      return hash;
    }

    const path = window.location.pathname || "/";
    const search = window.location.search || "";
    if (path === "/reset-password") {
      return `#/reset-password${search}`;
    }
    if (path === "/verify-email") {
      return `#/verify-email${search}`;
    }
    if (path === "/email-change-confirm") {
      return `#/email-change-confirm${search}`;
    }
    return "#/";
  };

  const [hash, setHash] = useState(resolveRoute());
  useEffect(() => {
    const onHashChange = () => setHash(resolveRoute());
    const onPopState = () => setHash(resolveRoute());
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
  return hash;
}

export default function App() {
  useTranslation();
  const hash = useHashRoute();
  /** Run lease sync before any child (e.g. Create) reads sessionStorage during render. */
  const createLeaseHashRef = useRef(null);
  if (createLeaseHashRef.current !== hash) {
    createLeaseHashRef.current = hash;
    syncCreateDraftLease(hash);
  }

  const isAccount = hash.startsWith('#/account');
  const isSignup = hash.startsWith('#/signup');
  const isLogin = hash.startsWith('#/login');
  const isCreate = hash.startsWith("#/create") && (hash.includes("guest=true") || isAuthenticated());
  const isCreateFromStudio = hash.startsWith("#/create") && hash.includes("from=studio");
  const isEdit = hash.startsWith('#/edit');
  const isEmailAction =
    hash.startsWith("#/email-action") ||
    hash.startsWith("#/verify-email") ||
    hash.startsWith("#/reset-password") ||
    hash.startsWith("#/email-change-confirm");
  const isShare = hash.startsWith("#/share");
  const isPreview = hash.startsWith("#/preview");
  const isEpisodes = hash.startsWith("#/episodes");
  const isFinalize = hash.startsWith("#/finalize");
  const isEditPodcast = hash.startsWith("#/edit-podcast");
  const isPreviewFromStudioSurface =
    hash.startsWith("#/preview") &&
    (hash.includes("from=episodes") || hash.includes("from=studio_create"));

  useEffect(() => {
    const sectionLinks = ['#about', '#episodes'];
    if (!sectionLinks.includes(hash)) {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className={`flex min-h-screen min-w-0 flex-col overflow-x-clip text-black dark:text-white transition-colors duration-500 ${
      isCreateFromStudio ? "bg-cream dark:bg-[#0a0a1a]" : "bg-cream dark:bg-[#0a0a1a]"
    }`}>
      <div className="h-2 min-w-0 shrink-0 bg-purple-gradient" aria-hidden />
      <Header />

      <main
        className={
          isEpisodes ||
          isCreateFromStudio ||
          isPreviewFromStudioSurface ||
          isEditPodcast ||
          isPreview ||
          isFinalize
            ? "app-main min-w-0 flex-1 pt-14"
            : "app-main min-w-0 flex-1 pt-16"
        }
      >
        {isAccount ? (
          <Account />
        ) : isEmailAction ? (
          <EmailAction />
        ) : isShare ? (
          <Share />
        ) : isSignup ? (
          <Signup />
        ) : isLogin ? (
          <Login />
        ) : isCreate ? (
          <Create />
        ) : hash.startsWith("#/create") ? (
          (() => {
            const needsAuth = hash.includes("auth=required");
            const token =
              localStorage.getItem("token") || sessionStorage.getItem("token");

            if (needsAuth && !token) {
              window.location.hash = "#/login?redirect=create";
              return null;
            }

            return <Create />;
           })()
            ) : isEditPodcast ? ( 
          <EditPodcast key={hash} />
        ) : isEdit ? (
          <EditScript />
        ) : isEpisodes ? (
          <Episodes />
        ) : isFinalize ? (
          <FinalizePublish />
        ) : isPreview ? (
          <Preview />
        ) : (
          <>
            <HeroSection />
            <AbstractArt />
            <AboutSection />
            <section id="episodes">
              <HowItWorks />
            </section>
            <FooterArt />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
