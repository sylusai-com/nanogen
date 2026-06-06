import Hero from "@/components/landing/Hero";
import Stats from "@/components/landing/Stats";
import BannerShowcase from "@/components/landing/BannerShowcase";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import ApiShowcase from "@/components/landing/ApiShowcase";
import ApiPricing from "@/components/landing/ApiPricing";
import Showcase from "@/components/landing/Showcase";
import CTA from "@/components/landing/CTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <BannerShowcase />
      <Features />
      <HowItWorks />
      <ApiShowcase />
      <ApiPricing />
      <Showcase />
      <CTA />
    </>
  );
}
