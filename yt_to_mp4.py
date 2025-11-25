#!/usr/bin/env python3
"""
YouTube to MP4 Downloader
Downloads YouTube videos as MP4 files with specified quality
"""

import sys
import subprocess

def download_youtube_video(url, quality='1080'):
    """
    Download a YouTube video as MP4 using yt-dlp

    Args:
        url: YouTube video URL
        quality: Video quality (default: 1080)
    """
    try:
        # Check if yt-dlp is installed
        try:
            subprocess.run(['yt-dlp', '--version'],
                         capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Error: yt-dlp is not installed.")
            print("Install it with: pip install yt-dlp")
            print("Or with Homebrew: brew install yt-dlp")
            return False

        # Download command
        # -f: format selection - best video with height <= quality + best audio, merged to mp4
        # --merge-output-format mp4: ensure output is MP4
        # -o: output template with title and video ID, saved to Clips folder
        cmd = [
            'yt-dlp',
            '-f', f'bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<={quality}][ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '-o', 'Clips/%(title)s_%(id)s.%(ext)s',
            url
        ]

        print(f"Downloading video at {quality}p quality...")
        print(f"URL: {url}")
        print()

        subprocess.run(cmd, check=True)
        print("\nDownload complete!")
        return True

    except subprocess.CalledProcessError as e:
        print(f"Error downloading video: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python yt_to_mp4.py <youtube_url> [quality]")
        print("Example: python yt_to_mp4.py https://www.youtube.com/watch?v=VIDEO_ID 1080")
        print("Quality options: 2160 (4K), 1440, 1080, 720, 480, 360")
        sys.exit(1)

    url = sys.argv[1]
    quality = sys.argv[2] if len(sys.argv) > 2 else '1080'

    download_youtube_video(url, quality)
