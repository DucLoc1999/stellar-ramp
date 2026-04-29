import { FeaturesSection } from "../components/sections/FeaturesSection";
import { FinalCtaSection } from "../components/sections/FinalCtaSection";
import { FaqSection } from "../components/sections/FaqSection";
import { HeroSection } from "../components/sections/HeroSection";
import { HowItWorksSection } from "../components/sections/HowItWorksSection";
import { RatesSection } from "../components/sections/RatesSection";
import { UserFeedbackSection } from "../components/sections/UserFeedbackSection";

export default function Index() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <RatesSection />
      <UserFeedbackSection />
      <FaqSection />
      <FinalCtaSection />
    </div>
  );
}
