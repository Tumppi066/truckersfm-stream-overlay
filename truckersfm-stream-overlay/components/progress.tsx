import React from 'react';

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const clampProgress = Math.min(100, Math.max(0, progress)); // Ensure progress is between 0 and 100

  return (
    <div className="absolute w-xl bg-[#00000] bottom-0 left-0 top-0">
      <div
        className='bg-[#8e8b8f15] h-full transition-all duration-500 ease-in-out'
        style={{
          width: `${clampProgress}%`,
        }}
      />
    </div>
  );
};

export default ProgressBar;