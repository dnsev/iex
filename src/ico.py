#! /usr/bin/env python
import os, sys, shutil;


def main():
	src = sys.argv[1];
	dest = sys.argv[2];

	files = os.listdir(src);
	for f in files:
		src_f = os.path.join(src, f);
		dest_f = os.path.join(dest, f);

		if (os.path.isfile(src_f) and not os.path.exists(dest_f)):
			try:
				shutil.copy(src_f, dest_f);
			except:
				pass;



if (__name__ == "__main__"): sys.exit(main());
