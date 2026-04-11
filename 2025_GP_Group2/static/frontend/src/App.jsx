// src/App.jsx
import React, { useEffect, useState } from "react";
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



function isAuthenticated() {
  return !!localStorage.getItem("token");
}

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

export default function App() {
  useTranslation();
  const hash = useHashRoute();
  const isAccount = hash.startsWith('#/account');
  const isSignup = hash.startsWith('#/signup');
  const isLogin = hash.startsWith('#/login');
  const isCreate = hash.startsWith("#/create") && (hash.includes("guest=true") || isAuthenticated());
  const isCreateFromStudio = hash.startsWith("#/create") && hash.includes("from=studio");
  const isEdit = hash.startsWith('#/edit');
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
    <div className={`min-h-screen flex flex-col text-black dark:text-white transition-colors duration-500 ${
      isCreateFromStudio ? "bg-cream dark:bg-[#0a0a1a]" : "bg-cream dark:bg-[#0a0a1a]"
    }`}>
      <div className="h-2 bg-purple-gradient"></div>
      <Header />

      <main className={(isEpisodes || isCreateFromStudio || isPreviewFromStudioSurface || isEditPodcast) ? "app-main pt-14 flex-1" : "app-main pt-16 flex-1"}>
        {isAccount ? (
          <Account />
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
          <EditPodcast />
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
