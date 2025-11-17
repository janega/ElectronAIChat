# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Include only code directories, NOT data directories
        # chroma_db, uploads, and chat_history.db will be created in AppData
        ('app', 'app'),  # Include the app directory
        ('utils', 'utils')  # Include the utils directory
    ],
    hiddenimports=[],
     #  'uvicorn.logging',
    #   'uvicorn.protocols',
    #   'uvicorn.lifespan',
   #    'uvicorn.protocols.http',
  #     'fastapi',
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(
    a.pure,
    a.zipped_data,
 #  cipher=block_cipher
)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Changed to False for --noconsole
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
