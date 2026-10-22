"use client";

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { EchonaModal, EchonaButton, EchonaLoader } from '../ui/EchonaUI';
import { QuillMap } from '../icons/QuillMap';

interface BulkImportModalProps {
  onClose: () => void;
  onImportComplete: () => void;
  importType: 'questions' | 'participants';
  targetId: string; // roundId for questions, quizId for participants
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onImportComplete, importType, targetId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (importType === 'participants') {
          await importParticipants(data);
        } else {
          await importQuestions(data);
        }
      } catch (err: any) {
        setError(err.message || 'The manifest could not be read. Please check the format and try again.');
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to decipher the file. It may be corrupted.');
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const importParticipants = async (data: any[]) => {
    const participants = data.map(row => ({
      username: row.username || row.Username || row.ID,
      password: row.password || row.Password,
      name: row.name || row.Name,
      college: row.college || row.College || '',
      email: row.email || row.Email || '',
      phone: row.phone || row.Phone ? String(row.phone || row.Phone) : '',
    }));

    if (participants.some(p => !p.username)) {
      throw new Error("Missing required field: username (Login ID) must be provided for all crew members.");
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/${targetId}/participants/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ participants })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'The server rejected the manifest. Check for duplicate usernames.');
    }
    
    setLoading(false);
    onImportComplete();
  };

  const importQuestions = async (data: any[]) => {
    const questions = data.map(row => {
      const options = [];
      const correctIdx = parseInt(row.correctOption || row.CorrectOption || '1');
      
      if (row.option1 || row.Option1) options.push({ text: row.option1 || row.Option1, isCorrect: correctIdx === 1 });
      if (row.option2 || row.Option2) options.push({ text: row.option2 || row.Option2, isCorrect: correctIdx === 2 });
      if (row.option3 || row.Option3) options.push({ text: row.option3 || row.Option3, isCorrect: correctIdx === 3 });
      if (row.option4 || row.Option4) options.push({ text: row.option4 || row.Option4, isCorrect: correctIdx === 4 });

      return {
        text: row.text || row.Question || row.text,
        type: row.type || row.Type || 'MCQ',
        marks: parseFloat(row.marks || row.Marks || '1'),
        negativeMarks: parseFloat(row.negativeMarks || row.NegativeMarks || '0'),
        explanation: row.explanation || row.Explanation || '',
        options
      };
    });

    if (questions.some(q => !q.text)) {
      throw new Error("Missing required field: Question text is missing for one or more entries.");
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/quizzes/rounds/${targetId}/questions/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ questions })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'The server rejected the questions manifest.');
    }
    
    setLoading(false);
    onImportComplete();
  };

  const title = importType === 'participants' ? 'IMPORT CREW MANIFEST' : 'IMPORT QUESTIONS MANIFEST';

  return (
    <EchonaModal isOpen={true} onClose={onClose} title={title}>
      {loading ? (
        <EchonaLoader text="READING MANIFEST..." />
      ) : (
        <div className="space-y-6">
          <p className="text-[#2B1710] font-semibold text-sm tracking-wide">
            Present your Excel (.xlsx) manifest to be charted into the log.
          </p>

          {error && (
            <div className="bg-[#741714] border border-[#5A1712] p-4 shadow-inner">
              <h4 className="text-[#F4E7C7] text-[10px] font-bold tracking-[0.2em] uppercase mb-1 flex items-center gap-2">
                <span className="text-xl">âš </span> MANIFEST COULD NOT BE CHARTED
              </h4>
              <p className="text-[#E7D19A] text-sm">{error}</p>
            </div>
          )}

          <div 
            onClick={() => fileInput.current?.click()}
            className="border-2 border-dashed border-[#8B5E34] hover:border-[#C7A04A] bg-[#E7D19A]/50 hover:bg-[#E7D19A]/80 p-10 text-center transition-colors cursor-pointer group"
          >
            <QuillMap className="w-12 h-12 text-[#8B5E34] mx-auto mb-4 group-hover:text-[#C7A04A] transition-colors" />
            <span className="text-[#2B1710] font-bold uppercase tracking-widest text-xs">
              Click to select manifest file
            </span>
            <input 
              type="file" 
              ref={fileInput} 
              className="hidden" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload}
            />
          </div>

          <div className="bg-[#17100C]/10 p-4 border border-[#8B5E34]/20">
            <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase mb-2">Required Format Details</p>
            <p className="text-[#2B1710] text-xs font-semibold">
              {importType === 'participants' 
                ? 'Expected Columns: username, password, name, college, email, phone'
                : 'Expected Columns: text, marks, negativeMarks, option1, option2, option3, option4, correctOption (1-4)'
              }
            </p>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-[#8B5E34]/30">
            <EchonaButton variant="ghost" onClick={onClose} className="!text-[#8B5E34] hover:!text-[#2B1710]">
              CANCEL
            </EchonaButton>
          </div>
        </div>
      )}
    </EchonaModal>
  );
};
