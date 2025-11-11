"""Text splitting utilities for semantic chunking."""
import re
from typing import List

class TextSplitter:
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        separator: str = "\n\n"
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separator = separator

    def split_text(self, text: str) -> List[str]:
        """Split text into semantic chunks respecting natural boundaries."""
        # First clean the text
        text = self._clean_text(text)
        
        # Split into initial segments by double newlines (paragraph breaks)
        segments = text.split(self.separator)
        segments = [s.strip() for s in segments if s.strip()]
        
        # Initialize chunks
        chunks = []
        current_chunk = []
        current_size = 0
        
        for segment in segments:
            # If adding this segment would exceed chunk size and we have content
            if current_size + len(segment) > self.chunk_size and current_chunk:
                # Join the current chunk and add it to chunks
                chunks.append(self._join_chunk(current_chunk))
                # Start new chunk with overlap
                if self.chunk_overlap > 0 and current_chunk:
                    # Keep the last segment(s) that fit within overlap
                    overlap_size = 0
                    overlap_segments = []
                    for seg in reversed(current_chunk):
                        if overlap_size + len(seg) <= self.chunk_overlap:
                            overlap_segments.insert(0, seg)
                            overlap_size += len(seg)
                        else:
                            break
                    current_chunk = overlap_segments
                    current_size = overlap_size
                else:
                    current_chunk = []
                    current_size = 0
            
            # Add the segment to the current chunk
            current_chunk.append(segment)
            current_size += len(segment)
        
        # Add the last chunk if it has content
        if current_chunk:
            chunks.append(self._join_chunk(current_chunk))
        
        return chunks

    def _clean_text(self, text: str) -> str:
        """Clean text by normalizing whitespace and fixing common OCR issues."""
        # Normalize line endings first
        text = text.replace('\r\n', '\n').replace('\r', '\n')

        # Collapse 3+ newlines into exactly two (preserve paragraph separators)
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Turn single newlines (line-wraps) into spaces but keep double-newline paragraph separators
        # (?<!\n)\n(?!\n) matches a single newline not preceded or followed by another newline
        text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)

        # Replace multiple spaces/tabs with a single space
        text = re.sub(r'[ \t]+', ' ', text)

        # Fix broken sentences where a period is immediately followed by a capital letter
        text = re.sub(r'\.(?=[A-Z])', '. ', text)

        # Normalize any remaining runs of 2+ newlines to exactly two
        text = re.sub(r'\n{2,}', '\n\n', text)

        return text.strip()

    def _join_chunk(self, chunk_segments: List[str]) -> str:
        """Join segments into a single chunk, ensuring proper spacing."""
        return "\n\n".join(chunk_segments)

    def split_by_section(self, text: str) -> List[str]:
        """Split text by section headers and major theme changes."""
        # Common section header patterns
        section_patterns = [
            r'\n[A-Z][A-Z ]{2,}[A-Z]\n',  # ALL CAPS HEADERS
            r'\n\d+\.\s+[A-Z][^.]+\n',     # Numbered sections
            r'\n[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*:\s*\n'  # Title Case Headers:
        ]
        
        # Combine patterns
        split_pattern = '|'.join(section_patterns)
        
        # Split by sections while keeping the headers
        sections = re.split(f'({split_pattern})', text)
        
        # Recombine header with its content
        chunks = []
        for i in range(0, len(sections)-1, 2):
            header = sections[i].strip()
            content = sections[i+1].strip() if i+1 < len(sections) else ""
            if header or content:
                chunks.append(f"{header}\n\n{content}".strip())
        
        return chunks