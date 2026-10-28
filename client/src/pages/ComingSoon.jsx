import React from 'react';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

export default function ComingSoon() {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 bg-tint rounded-full flex items-center justify-center text-primary mb-4">
        <Construction size={32} />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        {t('app.comingSoon')}
      </h2>
      <p className="text-slate-500 max-w-md">
        We are working hard to bring this feature to you. Please check back later.
      </p>
    </div>
  );
}
