"use client";

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { EchonaModal, EchonaButton, EchonaLoader } from '../ui/EchonaUI';
import { QuillMap } from '../icons/QuillMap';
import { Anchor } from '../icons/Anchor';

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

        if (data.length === 0) {
          throw new Error("The uploaded sheet is empty. Please provide question data rows.");
        }

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
    const questions = data.map((row: any, idx: number) => {
      const title = (row.title || row.Title || row.name || row.Name || row.question || row.Question || row.text || row.Text || '').trim();
      const description = (row.description || row.Description || row.desc || row.Desc || row.problem || row.Problem || '').trim();
      const points = parseFloat(row.points || row.Points || row.marks || row.Marks || '100');

      if (!title) {
        throw new Error(`Row ${idx + 2}: 'title' is required.`);
      }
      if (!description) {
        throw new Error(`Row ${idx + 2} ("${title}"): 'description' is required.`);
      }

      return {
        title,
        description,
        points: isNaN(points) ? 100 : Math.round(points),
        testInput1: String(row.testInput1 ?? row.TestInput1 ?? row.input1 ?? row.Input1 ?? ''),
        testExpected1: String(row.testExpected1 ?? row.TestExpected1 ?? row.expected1 ?? row.Expected1 ?? row.output1 ?? '').trim(),
        testInput2: String(row.testInput2 ?? row.TestInput2 ?? row.input2 ?? row.Input2 ?? ''),
        testExpected2: String(row.testExpected2 ?? row.TestExpected2 ?? row.expected2 ?? row.Expected2 ?? row.output2 ?? '').trim(),
        testInput3: String(row.testInput3 ?? row.TestInput3 ?? row.input3 ?? row.Input3 ?? ''),
        testExpected3: String(row.testExpected3 ?? row.TestExpected3 ?? row.expected3 ?? row.Expected3 ?? row.output3 ?? '').trim(),
        cStarter: typeof row.cStarter === 'string' ? row.cStarter : (typeof row.CStarter === 'string' ? row.CStarter : ''),
        cppStarter: typeof row.cppStarter === 'string' ? row.cppStarter : (typeof row.CppStarter === 'string' ? row.CppStarter : ''),
        javaStarter: typeof row.javaStarter === 'string' ? row.javaStarter : (typeof row.JavaStarter === 'string' ? row.JavaStarter : ''),
      };
    });

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

  const handleDownloadSample = () => {
    if (importType === 'participants') {
      const sampleParticipants = [
        {
          username: 'sailor01',
          password: 'secretpassword',
          name: 'Jack Sparrow',
          college: 'Seven Seas Academy',
          email: 'jack@echona.com',
          phone: '9876543210'
        },
        {
          username: 'sailor02',
          password: 'secretpassword',
          name: 'Will Turner',
          college: 'Port Royal Institute',
          email: 'will@echona.com',
          phone: '9876543211'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(sampleParticipants);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Participants');
      XLSX.writeFile(wb, 'sample_participants_manifest.xlsx');
    } else {
      const sampleQuestions = [
        {
          title: 'Sum of Two Treasures',
          description: 'The pirate crew found two treasure chests. Read two integers A and B from standard input separated by a space, and print their sum to standard output.',
          points: 100,
          testInput1: '5 7',
          testExpected1: '12',
          testInput2: '100 250',
          testExpected2: '350',
          testInput3: '-15 45',
          testExpected3: '30',
          cStarter: '',
          cppStarter: '',
          javaStarter: ''
        },
        {
          title: 'Reverse the Secret Map Code',
          description: 'To decipher the pirate coordinates, reverse the given string. Read a single line string from standard input and print the reversed string.',
          points: 150,
          testInput1: 'echona',
          testExpected1: 'anohce',
          testInput2: 'blackpearl',
          testExpected2: 'lraepkcalb',
          testInput3: 'ahoy sailor',
          testExpected3: 'rolias yoha',
          cStarter: '',
          cppStarter: '',
          javaStarter: ''
        },
        {
          title: 'Max Cannon Power',
          description: 'Given N integers representing cannon power levels, find and output the maximum power value. The first line contains N. The second line contains N space-separated integers.',
          points: 200,
          testInput1: '5\n10 45 20 80 30',
          testExpected1: '80',
          testInput2: '4\n-5 -10 -2 -50',
          testExpected2: '-2',
          testInput3: '6\n100 900 300 900 500 200',
          testExpected3: '900',
          cStarter: '',
          cppStarter: '',
          javaStarter: ''
        }
      ];

      const ws = XLSX.utils.json_to_sheet(sampleQuestions);
      ws['!cols'] = [
        { wch: 28 }, // title
        { wch: 55 }, // description
        { wch: 10 }, // points
        { wch: 18 }, // testInput1
        { wch: 18 }, // testExpected1
        { wch: 18 }, // testInput2
        { wch: 18 }, // testExpected2
        { wch: 18 }, // testInput3
        { wch: 18 }, // testExpected3
        { wch: 20 }, // cStarter
        { wch: 20 }, // cppStarter
        { wch: 20 }, // javaStarter
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      XLSX.writeFile(wb, 'sample_questions_manifest.xlsx');
    }
  };

  const title = importType === 'participants' ? 'IMPORT CREW MANIFEST' : 'IMPORT QUESTIONS MANIFEST';

  return (
    <EchonaModal isOpen={true} onClose={onClose} title={title}>
      {loading ? (
        <EchonaLoader text="READING MANIFEST..." />
      ) : (
        <div className="space-y-5">
          <p className="text-[#2B1710] font-semibold text-sm tracking-wide">
            Present your Excel (.xlsx) manifest to be charted into the log.
          </p>

          {error && (
            <div className="bg-[#741714] border border-[#5A1712] p-4 shadow-inner">
              <h4 className="text-[#F4E7C7] text-[10px] font-bold tracking-[0.2em] uppercase mb-1 flex items-center gap-2">
                <span className="text-xl">⚠️</span> MANIFEST COULD NOT BE CHARTED
              </h4>
              <p className="text-[#E7D19A] text-sm">{error}</p>
            </div>
          )}

          {/* Upload Dropzone */}
          <div 
            onClick={() => fileInput.current?.click()}
            className="border-2 border-dashed border-[#8B5E34] hover:border-[#C7A04A] bg-[#E7D19A]/50 hover:bg-[#E7D19A]/80 p-8 text-center transition-colors cursor-pointer group rounded-sm"
          >
            <QuillMap className="w-10 h-10 text-[#8B5E34] mx-auto mb-3 group-hover:text-[#C7A04A] transition-colors" />
            <span className="text-[#2B1710] font-bold uppercase tracking-widest text-xs block mb-1">
              Click to select manifest file
            </span>
            <span className="text-[#8B5E34] text-[11px] block">
              Supports .xlsx, .xls, .csv spreadsheets
            </span>
            <input 
              type="file" 
              ref={fileInput} 
              className="hidden" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileUpload}
            />
          </div>

          {/* Format & Download Sample Box */}
          <div className="bg-[#17100C]/10 p-4 border border-[#8B5E34]/30 rounded-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#8B5E34]/20">
              <p className="text-[#8B5E34] text-[10px] font-bold tracking-[0.2em] uppercase">
                Required Format Details
              </p>
              
              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#2B1710] border border-[#C7A04A] text-[#F4E7C7] hover:bg-[#C7A04A] hover:text-[#17100C] text-[10px] font-bold tracking-wider uppercase transition-all shadow-sm"
              >
                <span>📥</span> DOWNLOAD SAMPLE EXCEL
              </button>
            </div>

            {importType === 'participants' ? (
              <p className="text-[#2B1710] text-xs font-semibold leading-relaxed">
                Expected Columns: <span className="font-mono text-[#8B5E34]">username, password, name, college, email, phone</span>
              </p>
            ) : (
              <div className="space-y-1.5 text-xs text-[#2B1710]">
                <p className="font-semibold">
                  <span className="text-[#741714] font-bold uppercase text-[10px] tracking-wider block mb-0.5">Mandatory Columns:</span>
                  <span className="font-mono text-[#8B5E34] text-[11px] bg-[#E7D19A]/40 px-1.5 py-0.5 rounded">title</span>,{" "}
                  <span className="font-mono text-[#8B5E34] text-[11px] bg-[#E7D19A]/40 px-1.5 py-0.5 rounded">description</span>,{" "}
                  <span className="font-mono text-[#8B5E34] text-[11px] bg-[#E7D19A]/40 px-1.5 py-0.5 rounded">points</span>,{" "}
                  <span className="font-mono text-[#8B5E34] text-[11px] bg-[#E7D19A]/40 px-1.5 py-0.5 rounded">testInput1</span>,{" "}
                  <span className="font-mono text-[#8B5E34] text-[11px] bg-[#E7D19A]/40 px-1.5 py-0.5 rounded">testExpected1</span>
                </p>
                <p className="text-[11px] text-[#8B5E34] pt-1">
                  <span className="font-bold uppercase text-[9px] tracking-wider block text-[#8B5E34]">Optional Vectors & Starters:</span>
                  <span className="font-mono">testInput2, testExpected2, testInput3, testExpected3, cStarter, cppStarter, javaStarter</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-[#8B5E34]/30">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="text-[#8B5E34] hover:text-[#C7A04A] text-xs font-bold tracking-wider uppercase underline underline-offset-4 transition-colors"
            >
              ⤓ Get Sample Sheet
            </button>

            <EchonaButton variant="ghost" onClick={onClose} className="!text-[#8B5E34] hover:!text-[#2B1710]">
              CANCEL
            </EchonaButton>
          </div>
        </div>
      )}
    </EchonaModal>
  );
};
