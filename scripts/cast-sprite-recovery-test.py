#!/usr/bin/env python3
"""Whole-silhouette extraction regressions; requires Pillow."""
import importlib.util, unittest
from pathlib import Path
from PIL import Image, ImageDraw
spec=importlib.util.spec_from_file_location('recovery',Path(__file__).with_name('recover-cast-sprite-sheets.py'))
recovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(recovery)
class ExtractionTests(unittest.TestCase):
    def test_pose_crossing_nominal_cell_is_complete(self):
        image=Image.new('RGBA',(256,128));ImageDraw.Draw(image).rectangle((110,20,145,90),fill='white')
        self.assertEqual(recovery.silhouettes(image),[[110,20,146,91]])
    def test_detached_nearby_detail_is_retained(self):
        image=Image.new('RGBA',(256,128));draw=ImageDraw.Draw(image)
        draw.rectangle((20,20,40,70),fill='white');draw.rectangle((43,30,45,35),fill='white')
        self.assertEqual(recovery.silhouettes(image),[[20,20,46,71]])
    def test_unassigned_detail_fails_instead_of_disappearing(self):
        image=Image.new('RGBA',(256,128));draw=ImageDraw.Draw(image)
        draw.rectangle((20,20,40,70),fill='white');draw.rectangle((90,30,92,35),fill='white')
        with self.assertRaisesRegex(ValueError,'Unassigned'):
            recovery.silhouettes(image)
    def test_separate_actors_remain_separate(self):
        image=Image.new('RGBA',(256,128));draw=ImageDraw.Draw(image)
        for x in (20,140):draw.rectangle((x,20,x+20,70),fill='white')
        self.assertEqual(len(recovery.silhouettes(image)),2)
if __name__=='__main__':unittest.main()
