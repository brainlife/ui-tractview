
#mri_convert /home/hayashis/syncthing/app/freesurfer-7.1.1/subjects/fsaverage/mri/aparc.a2009s+aseg.mgz fsaverage.aparc.a2009s+aseg.nii.gz

mri_convert /home/hayashis/syncthing/app/freesurfer-7.1.1/subjects/cvs_avg35_inMNI152/mri/aparc.a2009s+aseg.mgz mni152.aparc.a2009s+aseg.nii.gz
singularity exec -e docker://brainlife/pythonvtk:1.1 ./freesurfer2vtks.py

rm *.nii.gz
