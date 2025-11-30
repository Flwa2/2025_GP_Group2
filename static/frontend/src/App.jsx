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
  const { i18n } = useTranslation();  
  const hash = useHashRoute();
  const isAccount = hash.startsWith('#/account');
  const isSignup = hash.startsWith('#/signup');
  const isLogin = hash.startsWith('#/login');
  const isCreate = hash.startsWith("#/create") && (hash.includes("guest=true") || isAuthenticated());
  const isEdit = hash.startsWith('#/edit');

  useEffect(() => {
    const sectionLinks = ['#about', '#episodes'];
    if (!sectionLinks.includes(hash)) {
      window.scrollTo(0, 0);
    }
  }, [hash]);
  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a1a] text-black dark:text-white overflow-x-hidden transition-colors duration-500">
      <div className="h-2 bg-purple-gradient"></div>
      <Header />

      <main className="pt-20">
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
        ) : isEdit ? (
          <EditScript />
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
        <Footer />
      </main>
    </div>
  );
}
