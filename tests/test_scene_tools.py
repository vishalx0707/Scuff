import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('scene_tools',pathlib.Path(__file__).parents[1]/'scripts'/'blender_scene_tools.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
class SceneToolsTest(unittest.TestCase):
    def test_budget_and_seed(self):
        triangles=[((0,0,0),(10,0,0),(0,10,0))]
        a=t.sample_scatter(triangles,10,12,7,2);b=t.sample_scatter(triangles,10,12,7,2)
        self.assertEqual(a,b);self.assertEqual(len(a['points']),12);self.assertTrue(a['stats']['capped'])
        self.assertNotEqual(t.layout_digest(a),t.layout_digest(t.sample_scatter(triangles,10,12,8,2)))
    def test_mask_and_exclusions(self):
        tris=[((0,0,0),(10,0,0),(0,10,0))]
        self.assertEqual(t.sample_scatter(tris,10,12,7,2,weights=[(0,0,0)])['points'],[])
        a=t.sample_scatter(tris,10,12,7,2,reject=lambda p:'exclusion' if p[0]<5 else None)
        self.assertTrue(all(p[0]>=5 for p in a['points']))
    def test_invalid_requests(self):
        for req in [{'action':'inventory','limit':True},{'action':'scatter_create','emitter':'x'}, {'action':'fog_create','output':'x','mode':'camera','size':[1,1,1],'density':float('nan')}, {'action':'inventory','code':'arbitrary'}]:
            self.assertFalse(t.run(req)['ok'])
    def test_empty_surface(self):
        self.assertEqual(t.sample_scatter([],1,10,0,1)['points'],[])
if __name__=='__main__':unittest.main()
