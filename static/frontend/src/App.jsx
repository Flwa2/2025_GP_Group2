// src/App.jsx
import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import AbstractArt from './components/AbstractArt';
import HowItWorks from './components/HowItWorks';
import AboutSection from './components/AboutSection';
import FooterArt from './components/FooterArt';
import Footer from './components/Footer';
import Account from './components/Account';
import Signup from './components/Signup';
import Login from './components/Login';
import EditScript from './components/EditScript';
import Create from './components/CreatePro'; // or './pages/CreatePro'

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
  const hash = useHashRoute();
  const isAccount = hash.startsWith('#/account');
  const isSignup = hash.startsWith('#/signup');
  const isLogin = hash.startsWith('#/login');
  const isCreate = hash.startsWith('#/create'); // same route
  const isEdit = hash.startsWith('#/edit');


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
