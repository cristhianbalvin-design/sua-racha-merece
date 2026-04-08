import { Check } from "lucide-react";

export const OnboardingStepper = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { num: 1, label: "Conta" },
    { num: 2, label: "Plan" },
    { num: 3, label: "Perfil" },
  ];

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -z-10 h-[2px] w-full -translate-y-1/2 bg-border">
           <div 
             className="h-full bg-primary transition-all duration-500 ease-in-out" 
             style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }} 
           />
        </div>
        
        {steps.map((step) => {
          const isCompleted = currentStep > step.num;
          const isCurrent = currentStep === step.num;
          
          return (
            <div key={step.num} className="flex flex-col items-center gap-2 relative bg-background px-2">
              <div 
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors
                  ${isCompleted ? "bg-primary border-primary text-primary-foreground" : 
                    isCurrent ? "bg-background border-primary text-primary" : 
                    "bg-background border-muted text-muted-foreground"}
                `}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-sm font-bold">{step.num}</span>}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider absolute -bottom-6 w-max ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
